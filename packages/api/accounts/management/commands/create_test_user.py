from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = "Create the test user (username: test, password: test)"

    def handle(self, *args, **kwargs):
        if User.objects.filter(username="test").exists():
            self.stdout.write(self.style.WARNING("User 'test' already exists — skipping."))
        else:
            User.objects.create_user(
                username="test",
                email="test@ppost.local",
                password="test",
            )
            self.stdout.write(self.style.SUCCESS("Created user: test / test"))
