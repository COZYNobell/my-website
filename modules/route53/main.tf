resource "aws_route53_record" "cname" {
  zone_id = var.zone_id
  name    = var.record_name
  type    = "CNAME"
  ttl     = 300
  records = [var.cname_value]
}
