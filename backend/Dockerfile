FROM maven:3.9.9-eclipse-temurin-21 AS build

ARG SERVICE_MODULE

WORKDIR /workspace/backend

COPY backend/pom.xml pom.xml
COPY backend/common/pom.xml common/pom.xml
COPY backend/auth-service/pom.xml auth-service/pom.xml
COPY backend/reminder-service/pom.xml reminder-service/pom.xml
COPY backend/notification-service/pom.xml notification-service/pom.xml
COPY backend/gateway-service/pom.xml gateway-service/pom.xml

RUN mvn -B -ntp -pl "${SERVICE_MODULE}" -am dependency:go-offline

COPY backend/common common
COPY backend/${SERVICE_MODULE} ${SERVICE_MODULE}

RUN mvn -B -ntp -pl "${SERVICE_MODULE}" -am package -DskipTests

FROM eclipse-temurin:21-jre

ARG SERVICE_MODULE

WORKDIR /app

RUN groupadd --system notifyhub && useradd --system --gid notifyhub notifyhub

COPY --from=build /workspace/backend/${SERVICE_MODULE}/target/${SERVICE_MODULE}-*.jar /app/app.jar

USER notifyhub
EXPOSE 8080 8081 8082 8083

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
