terraform {
  required_providers {
    atproto = {
      source  = "entropitor/atproto"
      version = "1.0.0"
    }
  }
}

provider "atproto" {
  handle       = var.handle
  app_password = var.app_password
}

variable "handle" {
  type        = string
  description = "The handle of the ATProto identity"
}
variable "app_password" {
  type        = string
  description = "The app password for the ATProto identity"
}

data "atproto_identity" "current" {}

output "did" {
  value = data.atproto_identity.current.did
}
