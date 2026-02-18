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
