FROM denoland/deno:2.2.8

WORKDIR /app
USER deno

COPY deno.json main.ts ./
RUN deno cache main.ts

CMD ["run", "--allow-all", "main.ts"]
