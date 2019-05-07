FROM tiangolo/uwsgi-nginx:python3.6-alpine3.7

ENV UWSGI_INI /rest_backend/uwsgi.ini

# Set up working directory
WORKDIR /rest_backend
COPY . .

# Install Flask requirements
RUN pip install -r requirements.pip
