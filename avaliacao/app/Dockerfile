FROM nginx:1.27-alpine

# Arquivos estaticos da aplicacao web
COPY index.html cursos.html app.js config.js style.css /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
