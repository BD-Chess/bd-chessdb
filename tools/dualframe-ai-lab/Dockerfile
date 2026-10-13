FROM python:3.12-slim
WORKDIR /app
COPY tools/dualframe-ai-lab/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt && useradd --create-home --uid 10001 dualframe
COPY tools/dualframe-ai-lab /app/tools/dualframe-ai-lab
COPY public/Nara/dualframe-lab /app/public/Nara/dualframe-lab
USER dualframe
ENV DUALFRAME_LIVE_ENABLED=0
EXPOSE 8765
CMD ["python", "tools/dualframe-ai-lab/server.py", "--bind", "0.0.0.0", "--port", "8765"]

