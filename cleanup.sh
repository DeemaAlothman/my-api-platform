#!/bin/bash

# ==========================================
# 🧹 My API Platform - Project Cleanup Script
# ==========================================

echo "🗑️  جاري حذف الملفات غير الضرورية (SQL القديمة وسكربتات النشر القديمة)..."

# ملفات SQL اليدوية التي تسبب مشاكل
rm -f add-evaluation-permissions-production.sql
rm -f add-leave-permissions.sql
rm -f add-leave-permissions-dot.sql
rm -f fix-leave-service-database.sql

# سكربتات النشر القديمة
rm -f deploy-to-production.sh
rm -f docs/old_deployment_notes.md 2>/dev/null

echo "✅ تم تنظيف المجلد بنجاح."
echo "   الملفات المتبقية هي فقط الملفات الضرورية للنظام."
