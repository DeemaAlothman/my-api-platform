import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = 'admin';
  const email = 'admin@wso.org';
  const fullName = 'مدير النظام';
  const plainPassword = 'password123';

  const hashed = await bcrypt.hash(plainPassword, 10);

  // upsert حتى ما يتكرر لو شغلته مرتين
  const user = await prisma.user.upsert({
    where: { username },
    update: {
      email,
      fullName,
      password: hashed,
      status: 'ACTIVE',
    },
    create: {
      username,
      email,
      fullName,
      password: hashed,
      status: 'ACTIVE',
    },
  });

  console.log('Seeded admin user:', { id: user.id, username: user.username, email: user.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
