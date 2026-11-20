# SOP: Adding a User

**Purpose:** Create a new user account for the application.  
**Who performs this:** Earl or any team member with backend access.  
**Prerequisites:** Backend is running, `.env` is configured.

---

## Steps

1. Open a terminal in `packages/api/`

2. Run:
```bash
python manage.py create_test_user
```

3. Or create a custom user via the Django shell:
```bash
python manage.py shell
```
Then:
```python
from django.contrib.auth.models import User
User.objects.create_user(username='newuser', password='password123')
exit()
```

---

## How to check it worked

- Log in at http://localhost:3000 with the new credentials
- Welcome screen appears after login

---

## If it fails

- Make sure the backend is running and `.env` is configured correctly
