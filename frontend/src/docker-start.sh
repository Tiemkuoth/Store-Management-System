#!/bin/bash

# Docker startup script for Store Management System
# Usage: ./docker-start.sh [dev|prod|nginx]

set -e

PROJECT_NAME="store-management"
ENV_FILE=".env"
ENV_DOCKER_FILE=".env.docker"
COMPOSE_FILE="docker-compose.yml"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

print_info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    print_success "Docker found: $(docker --version)"

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    print_success "Docker Compose found: $(docker-compose --version)"
}

check_env_files() {
    if [ ! -f "$ENV_FILE" ]; then
        print_error ".env file not found"
        print_info "Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example "$ENV_FILE"
            print_warn "Please update .env with your configuration"
        else
            print_error ".env.example not found either"
            exit 1
        fi
    fi
}

setup_ssl_dev() {
    if [ ! -d "ssl" ]; then
        print_info "Creating SSL directory for development..."
        mkdir -p ssl
    fi

    if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
        print_info "Generating self-signed SSL certificate (development only)..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/key.pem \
            -out ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        print_success "SSL certificate generated"
    else
        print_success "SSL certificates found"
    fi
}

start_dev() {
    print_header "Starting Development Environment"
    
    check_docker
    check_env_files
    
    print_info "Building Docker images..."
    docker-compose build
    
    print_info "Starting services..."
    docker-compose up -d
    
    print_success "Services started!"
    print_info "Application: http://localhost:5000"
    print_info "MySQL: 127.0.0.1:3306"
    print_info "Frontend: http://localhost:5173"
    
    print_info "View logs: docker-compose logs -f app"
}

start_prod() {
    print_header "Starting Production Environment"
    
    check_docker
    check_env_files
    
    if grep -q "NODE_ENV=development" "$ENV_FILE"; then
        print_warn "NODE_ENV is set to development in .env"
        print_info "For production, set NODE_ENV=production"
    fi
    
    setup_ssl_dev
    
    print_info "Building Docker images..."
    docker-compose build
    
    print_info "Starting services..."
    docker-compose up -d
    
    print_success "Services started in production mode!"
    print_info "Application: https://localhost (via Nginx)"
    print_info "API: https://localhost/api"
    
    print_warn "Remember to:"
    print_warn "- Update SSL certificates with production certs"
    print_warn "- Configure firewall rules"
    print_warn "- Setup automated backups"
    print_warn "- Monitor logs and resources"
}

start_with_nginx() {
    print_header "Starting with Nginx Reverse Proxy"
    
    check_docker
    check_env_files
    setup_ssl_dev
    
    print_info "Building Docker images..."
    docker-compose --profile nginx build
    
    print_info "Starting services with Nginx..."
    docker-compose --profile nginx up -d
    
    print_success "Services started with Nginx!"
    print_info "Application: https://localhost"
    print_info "API: https://localhost/api"
    print_info "Application (direct): http://localhost:5000"
    
    print_info "View logs:"
    print_info "  All: docker-compose logs -f"
    print_info "  Nginx: docker-compose logs -f nginx"
    print_info "  App: docker-compose logs -f app"
}

stop() {
    print_header "Stopping Services"
    
    docker-compose down
    
    print_success "Services stopped"
}

status() {
    print_header "Service Status"
    docker-compose ps
}

logs() {
    SERVICE=${1:-app}
    print_header "Logs for $SERVICE"
    docker-compose logs -f "$SERVICE"
}

cleanup() {
    print_header "Cleanup (WARNING: This removes data!)"
    
    read -p "Are you sure? This will remove all containers and volumes (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        print_success "Cleanup complete"
    else
        print_info "Cleanup cancelled"
    fi
}

# Main
case "${1:-dev}" in
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    nginx)
        start_with_nginx
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    logs)
        logs "${2:-app}"
        ;;
    clean)
        cleanup
        ;;
    *)
        echo "Usage: $0 {dev|prod|nginx|stop|status|logs|clean}"
        echo ""
        echo "Commands:"
        echo "  dev              Start development environment (default)"
        echo "  prod             Start production environment with SSL"
        echo "  nginx            Start with Nginx reverse proxy"
        echo "  stop             Stop all services"
        echo "  status           Show service status"
        echo "  logs [service]   View logs (default: app)"
        echo "  clean            Remove all containers and volumes (WARNING: data loss!)"
        exit 1
        ;;
esac
