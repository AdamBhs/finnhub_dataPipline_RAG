FROM python:3.12-slim

WORKDIR /app

# Mirror the repository layout (/app/FinnhubProducer/src + /app/schemas) so the
# producer's ROOT_DIR = Path(__file__).resolve().parents[2] resolves to /app,
# matching how it is run from the repository root on the host.
COPY FinnhubProducer/requirements.txt ./FinnhubProducer/requirements.txt

RUN pip install --no-cache-dir -r ./FinnhubProducer/requirements.txt

COPY FinnhubProducer/src/ ./FinnhubProducer/src/
COPY schemas/ ./schemas/

CMD ["python", "FinnhubProducer/src/finnhub_producer.py"]