# Use official Python runtime as base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy application files
COPY . .

# Expose the port that the app runs on
EXPOSE 5000

# Set environment variable for port
ENV PORT=5000

# Run the application
CMD ["python", "main.py"]