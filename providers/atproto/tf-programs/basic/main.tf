terraform {
  required_providers {
    atproto = {
      source  = "entropitor/atproto"
      version = "0.0.1"
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

resource "atproto_record" "status" {
  collection = "xyz.statusphere.status"
  record = {
    "$type"   = "xyz.statusphere.status"
    createdAt = "2025-08-28T05:43:47.483Z"
    status    = "🌐"
  }
}

resource "atproto_statusphere_status" "status" {
  rkey = "second"

  status = "🌍"
}

data "atproto_account" "barack_obama" {
  handle = "barackobama.bsky.social"
}
resource "atproto_tangled_follow" "barack_obama" {
  subject = data.atproto_account.barack_obama.did
}

# resource "atproto_tangled_repository" "test" {
#   knot = "knot1.tangled.sh"
#   name = "test"
# }
# resource "atproto_tangled_repository_collaborator" "entropitor" {
#   repo    = atproto_tangled_repository.test.uri
#   subject = data.atproto_account.barack_obama.did
# }


resource "atproto_tangled_profile" "profile" {
  bluesky     = false
  description = "Test account for a Tangled terraform provider"
  links = [
    "https://entropitor.com",
  ]
}
