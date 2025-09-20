data "atproto_account" "barack_obama" {
  handle = "barackobama.bsky.social"
}
resource "atproto_tangled_knot_member" "member" {
  subject = data.atproto_account.barack_obama.did
  domain  = "knot.examle.com"
}
