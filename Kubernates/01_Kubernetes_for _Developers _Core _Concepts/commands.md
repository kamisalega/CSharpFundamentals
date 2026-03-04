# Kubernetes - Core Concepts - Komendy

## Konteksty (przełączanie klastrów)

```bash
# Wyświetla wszystkie dostępne konteksty
kubectl config get-contexts

# Wyświetla aktualnie używany kontekst
kubectl config current-context

# Przełącza na kontekst Docker Desktop
kubectl config use-context docker-desktop
```

## Tworzenie i zarządzanie Deploymentami

```bash
# Tworzy Deployment z pliku YAML (--save-config zapisuje konfigurację w adnotacji obiektu,
# co pozwala później używać "kubectl apply")
kubectl create -f nginx.deployment.yml --save-config

# Aktualizuje Deployment (tworzy jeśli nie istnieje) na podstawie pliku YAML
kubectl apply -f nginx.deployment.yml
```

## Podgląd zasobów

```bash
# Wyświetla listę podów
kubectl get pods

# Wyświetla wszystkie zasoby (pods, services, deployments, replicasets)
kubectl get all

# Wyświetla szczegółowe informacje o konkretnym Deployment
kubectl describe deploy my-nginx
```

## Rolling Update (aktualizacja bez przestojów)

```bash
# Tworzy wszystkie zasoby z katalogu rolling-update/
kubectl create -f rolling-update/. --save-config --record

# Aktualizuje Deployment (np. nowa wersja obrazu) - Kubernetes stopniowo
# podmienia pody na nowe, zachowując dostępność aplikacji
kubectl apply -f rolling-update/nginx.deployment.yml

# Aktualizuje/tworzy Service (udostępnia pody na zewnątrz)
kubectl apply -f rolling-update/nginx.service.yml

# Przekierowuje port lokalny 8080 na port 80 Service'u (do testowania w przeglądarce)
kubectl port-forward svc/nginx-service 8080:80

# Sprawdza status rolling update w czasie rzeczywistym
kubectl rollout status deployment my-nginx

# Usuwa konkretny Deployment
kubectl delete deployment.apps/kubernetes-dashboard-web
```

### Testowanie rolling update (PowerShell)

```powershell
# Pozwala uruchomić skrypt w bieżącej sesji PowerShell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Skrypt wysyłający ciągłe requesty do serwisu (żeby zobaczyć,
# że aplikacja odpowiada podczas aktualizacji)
rolling-update/curl-loop.ps1
```

## Rollback (cofanie Deploymentów)

```bash
# Wyświetla historię wersji Deploymentu
kubectl rollout history deployment [deployment-name]

# Wyświetla szczegóły konkretnej rewizji (np. jaki obraz był użyty)
kubectl rollout history deployment [deployment-name] --revision=2

# Sprawdza status aktualnego rolloutu
kubectl rollout status -f file.deployment.yml

# Cofa Deployment do poprzedniej wersji
kubectl rollout undo -f file.deployment.yml

# Cofa Deployment do konkretnej rewizji (np. rewizja 2)
kubectl rollout undo deployment [deployment-name] --to-revision=2
```



## Canary Deployments

```bash
# Budowanie obrazu stable-app
cd stable-app
docker build -t stable-app -f dockerfile .

# Zastosowanie Deploymentu i Service'u
kubectl apply -f stable.deployment.yml
kubectl apply -f stable.service.yml

# Sprawdzenie podów canary deploymentu
kubectl get pods -l app=aspnetcore -w
```

### Rollout canary deploymentu

```bash
# Status rolloutu
kubectl rollout status deployment/stable-deployment

# Historia rolloutów
kubectl rollout history deployment/stable-deployment

# Cofnięcie do poprzedniej wersji
kubectl rollout undo deployment/stable-deployment

# Cofnięcie do konkretnej rewizji
kubectl rollout undo deployment/stable-deployment --to-revision=2

# Pauza rolloutu
kubectl rollout pause deployment/stable-deployment

# Wznowienie rolloutu
kubectl rollout resume deployment/stable-deployment

# Restart (przebudowanie podów z nowym obrazem)
kubectl rollout restart deployment/stable-deployment
```

### Debugowanie podów

```bash
# Szczegóły poda (eventy, status, konfiguracja)
kubectl describe pod <pod-name>

# Logi poda (stdout aplikacji)
kubectl logs <pod-name>
```

## Usuwanie zasobów

```bash
# Usunięcie Service'u
kubectl delete service/nginx-service

# Usunięcie Deploymentu
kubectl delete deployment/stable-deployment
```