# Q-DRIFT engine and console on a Hugging Face Docker Space (free CPU tier).
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV HOST=0.0.0.0 PORT=7860 PYTHONUNBUFFERED=1
EXPOSE 7860
CMD ["python", "app/server.py"]
