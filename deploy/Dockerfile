# 生产运行底座：基于轻量级 Nginx Alpine (体积仅约 20MB)
FROM nginx:alpine

# 拷贝针对 3D WebGL / SPA 深度调优的 Nginx 配置文件
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# 拷贝预编译好的生产前端静态产物
COPY dist/ /usr/share/nginx/html/

# 赋予静态读取权限
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
