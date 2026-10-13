FROM grafana/grafana:latest

COPY ./provisioning /etc/grafana/provisioning
COPY ./dashboards /var/lib/grafana/dashboards
COPY ./grafana.ini /etc/grafana/grafana.ini

RUN grafana cli plugins install hadesarchitect-cassandra-datasource