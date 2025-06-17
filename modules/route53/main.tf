# ~/terraform/modules/route53/main.tf

resource "aws_route53_record" "this" {
  zone_id = var.zone_id
  name    = var.record_name
  type    = "CNAME"
  ttl     = 60

  records = [var.cname_value]
}
