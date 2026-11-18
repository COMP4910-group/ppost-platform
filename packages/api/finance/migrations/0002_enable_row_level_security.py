"""
Turn on Row Level Security (RLS) for every finance table in Supabase.

Why: Supabase also exposes tables in the public schema through its own REST API,
reachable with the public "anon" key that ships in the website. With RLS on and
no policies, that public route sees nothing. Django is unaffected because it
connects as the table owner, which RLS does not apply to.

Only runs on PostgreSQL (skipped for the SQLite test database).
"""
from django.db import migrations

TABLES = [
    "finance_rate", "finance_estimate", "finance_cost_line", "finance_basis_of_estimate",
    "finance_funding_source", "finance_funding_request", "finance_financial_entry",
    "finance_assistance_item", "finance_funding_mix", "finance_change",
]


def enable_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table in TABLES:
        schema_editor.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;')


def disable_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table in TABLES:
        schema_editor.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY;')


class Migration(migrations.Migration):
    dependencies = [("finance", "0001_initial")]
    operations = [migrations.RunPython(enable_rls, disable_rls)]
