# SOP: Resetting Synthetic Data

**Purpose:** Reset the application to its demo state with synthetic data.  
**Who performs this:** Any team member.  
**Prerequisites:** Application is running.

---

## Steps

The synthetic data for Audit & Approvals and Funding & Assistance is hardcoded in the frontend components. No reset is needed — refreshing the page restores it to its default state.

For database data, run:
```bash
cd packages/api
python manage.py flush
python manage.py migrate
python manage.py create_test_user
```

---

## How to check it worked

- Log in and verify pages display their default synthetic data
- Dashboard shows Clearwater Ridge Wildfire as the active event
