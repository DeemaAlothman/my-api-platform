INSERT INTO permissions (id, name, "displayName", description, module, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v."displayName", v.description, 'warehouse', NOW(), NOW()
FROM (VALUES
  ('warehouse.reports.read', 'عرض تقارير المستودع', 'View warehouse reports (stock valuation, purchases/sales summaries, variances, ...)')
) AS v(name, "displayName", description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);
