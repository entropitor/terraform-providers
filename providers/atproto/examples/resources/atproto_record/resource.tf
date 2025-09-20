resource "atproto_record" "status" {
  collection = "xyz.statusphere.status"
  record = {
    "$type"   = "xyz.statusphere.status"
    createdAt = "2025-08-28T05:43:47.483Z"
    status    = "🌐"
  }
}
