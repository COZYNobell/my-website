resource "aws_launch_template" "lt" {
  name_prefix   = "web-lt-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  vpc_security_group_ids = var.security_group_ids

  user_data = base64encode(<<EOF
#!/bin/bash
echo "DB_HOST=${var.db_host}" >> /etc/environment
yum update -y
yum install -y nginx
systemctl enable nginx
systemctl start nginx
EOF
  )
}

resource "aws_autoscaling_group" "asg" {
  name                      = "web-asg"
  desired_capacity          = 2
  max_size                  = 3
  min_size                  = 1
  vpc_zone_identifier       = var.vpc_subnets
  launch_template {
    id      = aws_launch_template.lt.id
    version = "$Latest"
  }

  target_group_arns = [var.target_group_arn]
  health_check_type = "EC2"

  tag {
    key                 = "Name"
    value               = "web-asg-instance"
    propagate_at_launch = true
  }
}
