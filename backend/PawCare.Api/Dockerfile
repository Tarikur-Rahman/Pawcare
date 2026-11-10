# syntax=docker/dockerfile:1.19
# Build with context backend/PawCare.Api: docker build -t pawcare-api:dev .
# COPY exclusions ensure local secrets/certificates are never baked into build layers.
# Also add a .dockerignore to the repository before shipping to minimize build context.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY PawCare.Api.csproj ./
RUN dotnet restore PawCare.Api.csproj

COPY --exclude=.env --exclude=.env.* --exclude=**/.env --exclude=**/.env.* \
     --exclude=**/bin/** --exclude=**/obj/** \
     --exclude=**/*.pfx --exclude=**/*.pem --exclude=**/*.key \
     . ./
RUN dotnet publish PawCare.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_EnableDiagnostics=0
EXPOSE 8080

# The official .NET Linux image provides a non-root app identity.
USER $APP_UID
ENTRYPOINT ["dotnet", "PawCare.Api.dll"]
