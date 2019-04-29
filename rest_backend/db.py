import pymongo
from flask import current_app, g

def get_db():
    if 'db' not in g:
        client = pymongo.MongoClient('wart_mongo_1', 27017)
        g.db_client = client
        g.db = client.wart
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    client = g.pop('db_client', None)

    if client is not None:
        client.close()

def init_app(app):
    app.teardown_appcontext(close_db)
