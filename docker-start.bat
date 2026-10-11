@echo off
REM Docker startup script for Store Management System (Windows)
REM Usage: docker-start.bat [dev|prod|nginx|stop|status|logs|clean]

setlocal enabledelayedexpansion

set "PROJECT_NAME=store-management"
set "ENV_FILE=.env"
set "ENV_DOCKER_FILE=.env.docker"
set "COMPOSE_FILE=docker-compose.yml"

REM Color codes (using title and echo tricks)
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "NC=[0m"

REM ============================================
REM Functions
REM ============================================

:print_header
    echo.
    echo ========================================
    echo %~1
    echo ========================================
    echo.
    exit /b 0

:print_info
    echo [INFO] %~1
    exit /b 0

:print_warn
    echo [WARN] %~1
    exit /b 0

:print_error
    echo [ERROR] %~1
    exit /b 0

:print_success
    echo [SUCCESS] %~1
    exit /b 0

:check_docker
    where docker >nul 2>nul
    if !errorlevel! neq 0 (
        call :print_error "Docker is not installed or not in PATH"
        exit /b 1
    )
    for /f "tokens=*" %%i in ('docker --version') do set "DOCKER_VERSION=%%i"
    call :print_success "Docker found: !DOCKER_VERSION!"

    where docker-compose >nul 2>nul
    if !errorlevel! neq 0 (
        where docker >nul 2>nul
        if !errorlevel! equ 0 (
            for /f "tokens=*" %%i in ('docker compose version') do set "COMPOSE_VERSION=%%i"
            call :print_success "Docker Compose found: !COMPOSE_VERSION!"
        ) else (
            call :print_error "Docker Compose is not installed"
            exit /b 1
        )
    ) else (
        for /f "tokens=*" %%i in ('docker-compose --version') do set "COMPOSE_VERSION=%%i"
        call :print_success "Docker Compose found: !COMPOSE_VERSION!"
    )
    exit /b 0

:check_env_files
    if not exist "%ENV_FILE%" (
        call :print_error ".env file not found"
        if exist ".env.example" (
            call :print_info "Creating from .env.example..."
            copy .env.example "%ENV_FILE%" >nul
            call :print_warn "Please update .env with your configuration"
        ) else (
            call :print_error ".env.example not found either"
            exit /b 1
        )
    )
    exit /b 0

:setup_ssl_dev
    if not exist "ssl" (
        call :print_info "Creating SSL directory for development..."
        mkdir ssl
    )

    if not exist "ssl\cert.pem" (
        call :print_info "Generating self-signed SSL certificate..."
        call :print_warn "Note: You need OpenSSL installed. If not available, use WSL or skip this step."
        REM This command requires OpenSSL to be installed
        REM Alternatively, use PowerShell or create manually
    ) else (
        call :print_success "SSL certificates found"
    )
    exit /b 0

:start_dev
    call :print_header "Starting Development Environment"
    
    call :check_docker
    if !errorlevel! neq 0 exit /b 1
    
    call :check_env_files
    if !errorlevel! neq 0 exit /b 1
    
    call :print_info "Building Docker images..."
    docker-compose build
    if !errorlevel! neq 0 (
        call :print_error "Build failed"
        exit /b 1
    )
    
    call :print_info "Starting services..."
    docker-compose up -d
    if !errorlevel! neq 0 (
        call :print_error "Failed to start services"
        exit /b 1
    )
    
    call :print_success "Services started!"
    call :print_info "Application: http://localhost:5000"
    call :print_info "MySQL: 127.0.0.1:3306"
    call :print_info "Frontend: http://localhost:5173"
    call :print_info.
    call :print_info "View logs: docker-compose logs -f app"
    exit /b 0

:start_prod
    call :print_header "Starting Production Environment"
    
    call :check_docker
    if !errorlevel! neq 0 exit /b 1
    
    call :check_env_files
    if !errorlevel! neq 0 exit /b 1
    
    call :setup_ssl_dev
    
    call :print_info "Building Docker images..."
    docker-compose build
    if !errorlevel! neq 0 (
        call :print_error "Build failed"
        exit /b 1
    )
    
    call :print_info "Starting services..."
    docker-compose up -d
    if !errorlevel! neq 0 (
        call :print_error "Failed to start services"
        exit /b 1
    )
    
    call :print_success "Services started in production mode!"
    call :print_info "Application: https://localhost (via Nginx)"
    call :print_info "API: https://localhost/api"
    call :print_warn.
    call :print_warn "Remember to:"
    call :print_warn "- Update SSL certificates with production certs"
    call :print_warn "- Configure firewall rules"
    call :print_warn "- Setup automated backups"
    call :print_warn "- Monitor logs and resources"
    exit /b 0

:start_with_nginx
    call :print_header "Starting with Nginx Reverse Proxy"
    
    call :check_docker
    if !errorlevel! neq 0 exit /b 1
    
    call :check_env_files
    if !errorlevel! neq 0 exit /b 1
    
    call :setup_ssl_dev
    
    call :print_info "Building Docker images..."
    docker-compose --profile nginx build
    if !errorlevel! neq 0 (
        call :print_error "Build failed"
        exit /b 1
    )
    
    call :print_info "Starting services with Nginx..."
    docker-compose --profile nginx up -d
    if !errorlevel! neq 0 (
        call :print_error "Failed to start services"
        exit /b 1
    )
    
    call :print_success "Services started with Nginx!"
    call :print_info "Application: https://localhost"
    call :print_info "API: https://localhost/api"
    call :print_info "Application (direct): http://localhost:5000"
    call :print_info.
    call :print_info "View logs:"
    call :print_info "  All: docker-compose logs -f"
    call :print_info "  Nginx: docker-compose logs -f nginx"
    call :print_info "  App: docker-compose logs -f app"
    exit /b 0

:stop_services
    call :print_header "Stopping Services"
    
    docker-compose down
    if !errorlevel! neq 0 (
        call :print_error "Failed to stop services"
        exit /b 1
    )
    
    call :print_success "Services stopped"
    exit /b 0

:show_status
    call :print_header "Service Status"
    docker-compose ps
    exit /b 0

:show_logs
    set "SERVICE=%~1"
    if "!SERVICE!"=="" set "SERVICE=app"
    call :print_header "Logs for !SERVICE!"
    docker-compose logs -f "!SERVICE!"
    exit /b 0

:cleanup
    call :print_header "Cleanup (WARNING: This removes data!)"
    
    setlocal enabledelayedexpansion
    set /p "confirm=Are you sure? This will remove all containers and volumes (y/N): "
    
    if /i "!confirm!"=="y" (
        docker-compose down -v
        call :print_success "Cleanup complete"
    ) else (
        call :print_info "Cleanup cancelled"
    )
    exit /b 0

REM ============================================
REM Main
REM ============================================

if "%1"=="" goto usage
if "%1"=="dev" goto start_dev_cmd
if "%1"=="prod" goto start_prod_cmd
if "%1"=="nginx" goto start_nginx_cmd
if "%1"=="stop" goto stop_cmd
if "%1"=="status" goto status_cmd
if "%1"=="logs" goto logs_cmd
if "%1"=="clean" goto clean_cmd
goto usage

:start_dev_cmd
    call :start_dev
    exit /b !errorlevel!

:start_prod_cmd
    call :start_prod
    exit /b !errorlevel!

:start_nginx_cmd
    call :start_with_nginx
    exit /b !errorlevel!

:stop_cmd
    call :stop_services
    exit /b !errorlevel!

:status_cmd
    call :show_status
    exit /b !errorlevel!

:logs_cmd
    call :show_logs "%2"
    exit /b !errorlevel!

:clean_cmd
    call :cleanup
    exit /b !errorlevel!

:usage
    echo.
    echo Usage: %0 [dev^|prod^|nginx^|stop^|status^|logs^|clean]
    echo.
    echo Commands:
    echo   dev              Start development environment (default)
    echo   prod             Start production environment with SSL
    echo   nginx            Start with Nginx reverse proxy
    echo   stop             Stop all services
    echo   status           Show service status
    echo   logs [service]   View logs (default: app)
    echo   clean            Remove all containers and volumes (WARNING: data loss!)
    echo.
    exit /b 1

endlocal
