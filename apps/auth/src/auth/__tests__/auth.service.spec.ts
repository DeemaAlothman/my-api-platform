import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Set required env vars before service instantiation
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-32-chars-min!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-32-chars-min!';

const mockPrisma = {
  $queryRaw: jest.fn(),
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(mockPrisma as any);
    jest.clearAllMocks();
  });

  // ===================== LOGIN =====================
  describe('login', () => {
    it('throws when user not found', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.login('unknown', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { id: 'u1', username: 'admin', email: 'a@b.com', fullName: 'Admin', password: hash },
      ]);
      await expect(service.login('admin', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens and user data on valid credentials', async () => {
      const hash = await bcrypt.hash('pass123', 10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { id: 'u1', username: 'emp', email: 'e@b.com', fullName: 'Emp', password: hash },
        ])
        .mockResolvedValueOnce([{ name: 'employee' }])
        .mockResolvedValueOnce([{ code: 'users:read' }, { code: 'leave_requests:create' }]);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.login('emp', 'pass123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.username).toBe('emp');
      expect(result.user.permissions).toContain('users:read');
    });

    it('gives super_admin the full permission list', async () => {
      const hash = await bcrypt.hash('pass', 10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { id: 'u2', username: 'sa', email: 'sa@b.com', fullName: 'SA', password: hash },
        ])
        .mockResolvedValueOnce([{ name: 'super_admin' }]);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.login('sa', 'pass');

      expect(result.user.roles).toContain('super_admin');
      expect(result.user.permissions.length).toBeGreaterThan(20);
      expect(result.user.permissions).toContain('evaluation:forms:gm-approval');
    });
  });

  // ===================== REFRESH =====================
  describe('refresh', () => {
    it('throws when refreshToken is empty string', async () => {
      await expect(service.refresh('')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when token signature is invalid', async () => {
      await expect(service.refresh('bad.token.here')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when token not found in DB', async () => {
      const token = jwt.sign(
        { sub: 'u1', username: 'admin', jti: 'abc' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '1d' },
      );
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when token is revoked', async () => {
      const token = jwt.sign(
        { sub: 'u1', username: 'admin', jti: 'abc' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '1d' },
      );
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce({
        id: '1', token, userId: 'u1', revoked: true,
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
    });

    it('returns new tokens and revokes old one', async () => {
      const token = jwt.sign(
        { sub: 'u1', username: 'admin', jti: 'xyz' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '1d' },
      );
      mockPrisma.refreshToken.findUnique.mockResolvedValueOnce({
        id: '1', token, userId: 'u1', revoked: false,
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockPrisma.refreshToken.update.mockResolvedValueOnce({});
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ name: 'employee' }])
        .mockResolvedValueOnce([{ code: 'users:read' }]);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.refresh(token);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).not.toBe(token);
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revoked: true } }),
      );
    });
  });

  // ===================== LOGOUT =====================
  describe('logout', () => {
    it('throws when no token provided', async () => {
      await expect(service.logout('')).rejects.toThrow(UnauthorizedException);
    });

    it('throws on invalid token', async () => {
      await expect(service.logout('Bearer invalid.token')).rejects.toThrow(UnauthorizedException);
    });

    it('returns loggedOut:true on valid access token', async () => {
      const token = jwt.sign(
        { sub: 'u1', username: 'admin', permissions: [] },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: '15m' },
      );
      const result = await service.logout(`Bearer ${token}`);
      expect(result).toEqual({ loggedOut: true });
    });
  });
});
