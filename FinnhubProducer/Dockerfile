FROM python:3.12-slim

WORKDIR /app

COPY FinnhubProducer/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY FinnhubProducer/src/ ./src/
COPY schemas/ ./schemas/

CMD ["python", "src/finnhub_producer.py"]