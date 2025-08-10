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

data "coolify_server" "localhost" {
  uuid = "d8okw4oc0sgs4ocogwo0g04c"
}

output "server" {
  value = data.coolify_server.localhost
}
