# ~/terraform/modules/autoscaling/main.tf

resource "aws_launch_template" "this" {
  name_prefix   = "web-launch-template-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  vpc_security_group_ids = var.security_group_ids

  # EC2 인스턴스 시작 시 실행될 스크립트
  # DB_HOST 환경 변수를 설정하여 애플리케이션이 RDS에 접속할 수 있도록 합니다.
  user_data = base64encode(<<EOF
#!/bin/bash
echo "DB_HOST=${var.db_host}" >> /etc/environment
EOF
  )

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "web-launch-template"
  }
}

resource "aws_autoscaling_group" "this" {
  desired_capacity    = var.desired_capacity
  max_size            = var.max_size
  min_size            = var.min_size
  vpc_zone_identifier = var.vpc_subnets
  target_group_arns   = [var.target_group_arn]

  launch_template {
    id      = aws_launch_template.this.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "web-asg-instance"
    propagate_at_launch = true
  }

  health_check_type         = "EC2"
  health_check_grace_period = 300 # 인스턴스가 시작되고 안정화될 시간을 줍니다.

  lifecycle {
    create_before_destroy = true
  }
}
