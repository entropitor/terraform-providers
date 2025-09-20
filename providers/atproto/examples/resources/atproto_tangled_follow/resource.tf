data "atproto_account" "barack_obama" {
  handle = "barackobama.bsky.social"
}
resource "atproto_tangled_follow" "barack_obama" {
  subject = data.atproto_account.barack_obama.did
}
