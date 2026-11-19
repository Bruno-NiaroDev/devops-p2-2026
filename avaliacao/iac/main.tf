terraform {
  required_providers {
    libvirt = {
      source  = "dmacvicar/libvirt"
      version = "0.8.3"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.5.2"
    }
  }
}

provider "libvirt" {
  uri = "qemu:///system"
}

# VM1 = aplicacao web (nginx + HTML) | VM2 = API Node.js + MySQL
locals {
  vms = {
    vm1 = { hostname = "vm1-web", memory = 1024, vcpu = 1 }
    vm2 = { hostname = "vm2-api", memory = 2048, vcpu = 2 }
  }
  ssh_pub_key = trimspace(file(pathexpand("~/.ssh/devops_lab.pub")))
}

# Imagem base do Ubuntu 24.04 (cloud image)
resource "libvirt_volume" "ubuntu_base" {
  name   = "p2-ubuntu-24.04-base.qcow2"
  pool   = "default"
  source = "https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img"
  format = "qcow2"
}

# Disco de cada VM (copy-on-write sobre a imagem base)
resource "libvirt_volume" "disk" {
  for_each = local.vms

  name           = "${each.value.hostname}.qcow2"
  pool           = "default"
  base_volume_id = libvirt_volume.ubuntu_base.id
  format         = "qcow2"
  size           = 10 * 1024 * 1024 * 1024
}

# ISO do cloud-init de cada VM
resource "libvirt_cloudinit_disk" "init" {
  for_each = local.vms

  name = "${each.value.hostname}-cloudinit.iso"
  pool = "default"

  user_data = templatefile("${path.module}/cloud_init.yaml", {
    hostname = each.value.hostname
    ssh_key  = local.ssh_pub_key
  })
}

resource "libvirt_domain" "vm" {
  for_each = local.vms

  name   = each.value.hostname
  memory = each.value.memory
  vcpu   = each.value.vcpu

  # Repassa a CPU real do host para a VM.
  # Sem isso a VM recebe uma CPU generica (qemu64) sem x86-64-v2,
  # e a imagem mysql:8.4 falha com "CPU does not support x86-64-v2".
  cpu {
    mode = "host-passthrough"
  }

  cloudinit = libvirt_cloudinit_disk.init[each.key].id

  network_interface {
    network_name   = "default"
    wait_for_lease = true
  }

  disk {
    volume_id = libvirt_volume.disk[each.key].id
  }

  console {
    type        = "pty"
    target_type = "serial"
    target_port = "0"
  }
}

# Gera o inventario do Ansible com os IPs reais das VMs
resource "local_file" "inventory" {
  filename        = "${path.module}/../ansible/inventory"
  file_permission = "0644"
  content         = <<-EOT
    [web]
    vm1 ansible_host=${libvirt_domain.vm["vm1"].network_interface[0].addresses[0]}

    [api]
    vm2 ansible_host=${libvirt_domain.vm["vm2"].network_interface[0].addresses[0]}

    [all:vars]
    ansible_user=aluno
    ansible_ssh_private_key_file=~/.ssh/devops_lab
    ansible_ssh_common_args='-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'
    ansible_python_interpreter=/usr/bin/python3
  EOT
}

output "vm1_web_ip" {
  value = libvirt_domain.vm["vm1"].network_interface[0].addresses[0]
}

output "vm2_api_ip" {
  value = libvirt_domain.vm["vm2"].network_interface[0].addresses[0]
}