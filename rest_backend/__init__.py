import os

from flask import Flask
from flask_cors import CORS

def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)

    # Set up CORS, allowing every origin in development mode
    if app.config['ENV'] == 'development':
        CORS(app)
    elif app.config['ENV'] == 'staging':
        CORS(app, origins=["staging.wart.ibbathon.com",
            "staging.wart.ibbmarsh.com"])
    elif app.config['ENV'] == 'production':
        CORS(app, origins=["wart.ibbathon.com","wart.ibbmarsh.com"])

    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
    )

    if test_config is None:
        app.config.from_pyfile('config.py', silent=True)
    else:
        app.config.from_mapping(test_config)

    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    from . import db, universal, inventory, desired, user_preferences, \
        last_updated, auth
    db.init_app(app)
    app.register_blueprint(universal.bp)
    app.register_blueprint(inventory.bp)
    app.register_blueprint(desired.bp)
    app.register_blueprint(user_preferences.bp)
    app.register_blueprint(last_updated.bp)

    return app
