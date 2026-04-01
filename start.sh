#!/bin/sh
npx prisma migrate deploy
npm run docker-start
