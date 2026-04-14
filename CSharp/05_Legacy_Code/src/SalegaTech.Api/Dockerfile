# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/SalegaTech.Api/SalegaTech.Api.csproj", "src/SalegaTech.Api/"]
COPY ["src/SalegaTech.Application/SalegaTech.Application.csproj", "src/SalegaTech.Application/"]
COPY ["src/SalegaTech.Domain/SalegaTech.Domain.csproj", "src/SalegaTech.Domain/"]
COPY ["src/SalegaTech.Common/SalegaTech.Common.csproj", "src/SalegaTech.Common/"]
COPY ["src/SalegaTech.ACL/SalegaTech.ACL.csproj", "src/SalegaTech.ACL/"]
COPY ["src/SalegaTech.Legacy/SalegaTech.Legacy.csproj", "src/SalegaTech.Legacy/"]
COPY ["src/SalegaTech.Infrastructure/SalegaTech.Infrastructure.csproj", "src/SalegaTech.Infrastructure/"]
RUN dotnet restore "./src/SalegaTech.Api/SalegaTech.Api.csproj"
COPY . .
WORKDIR "/src/src/SalegaTech.Api"
RUN dotnet build "./SalegaTech.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

# This stage is used to publish the service project to be copied to the final stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./SalegaTech.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SalegaTech.Api.dll"]