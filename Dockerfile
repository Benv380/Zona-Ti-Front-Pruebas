# Version fija a proposito -- "npm install -g pnpm" sin version tomaba la
# ultima disponible en cada build, y el formato de pnpm-workspace.yaml
# (ver ese archivo) cambio entre versiones mayores de pnpm (10 -> 11 -> 12
# usan claves distintas para aprobar scripts de postinstall). Sin fijar,
# un build futuro podia volver a fallar con el mismo ERR_PNPM_IGNORED_BUILDS
# apenas saliera una version nueva de pnpm, aunque el codigo no hubiera
# cambiado en nada.
FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.5.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install
COPY . .
RUN pnpm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
