import pymongo
from flask import current_app, g
from datetime import datetime

def get_db():
    """Keeps a single connection available throughout a request's lifetime."""
    if 'db' not in g:
        client = pymongo.MongoClient(
            current_app.config['DATABASE_URI'],
            current_app.config['DATABASE_PORT']
        )
        g.db_client = client
        g.db = client.wart
    return g.db

def close_db(e=None):
    """Closes any open connections at the end of a request's life."""
    db = g.pop('db', None)
    client = g.pop('db_client', None)

    if client is not None:
        client.close()

def init_app(app):
    """Setup database hooks for app."""
    app.teardown_appcontext(close_db)

def get_collection_last_updated_max(
        collection, user_id=None, compare_last_updated=None
    ):
    """Gets a special last_updated object from the given collection.
    This last_updated value is then compared to the given older last_updated.
    Returns the newer of the two. Used to determine the most recent
    last_updated of a number of collections by calling this method repeatedly
    with the results of the previous call."""
    if not compare_last_updated:
        compare_last_updated = datetime.utcfromtimestamp(0)

    query = {'last_updated': {'$exists': True}}
    if user_id != None:
        query['user_id'] = user_id

    item = collection.find_one(query)
    if item and item['last_updated'] > compare_last_updated:
        return item['last_updated']
    else:
        return compare_last_updated

def set_collection_last_updated(collection, user_id=None, last_updated=None):
    """Sets the special last_updated object for the given collection."""
    if not last_updated:
        last_updated = datetime.utcnow()

    query = {'last_updated': {'$exists': True}}
    data = {'last_updated': last_updated}
    if user_id != None:
        query['user_id'] = user_id
        data['user_id'] = user_id

    collection.update_one(query, {'$set': data}, upsert=True)
    return last_updated
