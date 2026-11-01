# Mono 6.12 is the last Mono release. Its msbuild still ships the .NET Framework 2.0 reference assemblies (2.0-api).
FROM mono:6.12

# Debian 10 (buster) is archived, and the image's Mono apt repository is gone.
# psqlODBC is the PostgreSQL driver for System.Data.Odbc (the "Npgsql" of 2005: no NuGet back then).
RUN rm -f /etc/apt/sources.list.d/mono-official-stable.list \
 && echo "deb http://archive.debian.org/debian buster main" > /etc/apt/sources.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends odbc-postgresql unixodbc \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .
RUN msbuild OrdersLegacy.csproj /p:Configuration=Release /p:OutputPath=/app /v:minimal

WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["mono", "/app/OrdersLegacy.exe"]
