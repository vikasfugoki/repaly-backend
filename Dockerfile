FROM amazon/aws-lambda-nodejs:22

# Set working directory before copying files
WORKDIR /var/task

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy compiled TypeScript files from dist/
COPY dist/ ./

COPY .env ./

# Correct entrypoint (assuming main.handler is inside dist/)
CMD ["dist/main.handler"]

