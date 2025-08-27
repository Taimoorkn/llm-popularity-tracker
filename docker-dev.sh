#!/bin/bash

echo "Starting PostgreSQL and Redis containers for development..."
echo

# Start only PostgreSQL and Redis for development
docker-compose up -d postgres redis

echo
echo "Waiting for services to be ready..."
sleep 10

echo
echo "Services started! You can now run:"
echo "  npm run db:migrate"
echo "  npm run db:seed"  
echo "  npm run dev"
echo
echo "To stop services: docker-compose down"
echo "To view logs: docker-compose logs -f postgres redis"
echo
echo "PostgreSQL: localhost:5432 (user: llm_user, password: changeme, db: llm_tracker)"
echo "Redis: localhost:6379"