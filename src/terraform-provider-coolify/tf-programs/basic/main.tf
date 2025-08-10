terraform {
  required_providers {
    coolify = {
      source  = "entropitor/coolify"
      version = "1.0.0"
    }
  }
}

provider "coolify" {
  base_url = "http://localhost:8000"
  token    = var.token
}

variable "token" {
  type        = string
  description = "Coolify API token"
}

resource "coolify_project" "main" {
  name        = "main"
  description = "My main project - Managed by Terraform"
}

data "coolify_servers" "all" {}
data "coolify_server" "localhost" {
  uuid = data.coolify_servers.all.servers[0].uuid
}

output "server" {
  value = data.coolify_server.localhost
}

resource "coolify_service" "mailpit" {
  type             = "mailpit"
  name             = "mailpit"
  project_uuid     = coolify_project.main.uuid
  environment_name = "production"
  server_uuid      = data.coolify_server.localhost.uuid
  instant_deploy   = false
}
