terraform {
  required_providers {
    coolify = {
      source  = "entropitor/coolify"
      version = "1.0.0"
    }
  }
}

provider "coolify" {
  base_url = var.url
  token    = var.token
}

variable "token" {
  type = string
}
variable "url" {
  type = string
}
variable "project_name" {
  type = string
}
variable "project_id" {
  type = string
}

resource "coolify_project" "main" {
  name        = var.project_name
  description = "Test project - Testing Terraform provider"
}
import {
  to = coolify_project.main
  id = var.project_id
}

output "project_id" {
  value = coolify_project.main.uuid
}
