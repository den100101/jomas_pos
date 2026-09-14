import os


class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get("SECRET_KEY")

    # ---------- Gmail SMTP ----------
    MAIL_SERVER = "smtp.gmail.com"
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get("GMAIL_USER")
    MAIL_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("GMAIL_USER")
