terraform {
  required_providers {
    coolify = {
      source  = "entropitor/coolify"
      version = "1.0.0"
    }
  }
}

provider "coolify" {
  base_url = "http://localhost:3000"
  token    = var.token
}

variable "token" {
  type        = string
  description = "Coolify API token"
}
