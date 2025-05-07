SUMMARY     = "Providing a ec2 multicast vcan receiver"
LICENSE     = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"

inherit systemd allarch

SRC_URI = " \
    file://vcan-ec2-receiver.env \
    file://vcan-ec2-receiver.sh \
    file://vcan-ec2-receiver.service \
"

do_configure[noexec] = "1"
do_compile[noexec] = "1"

do_install() {
    install -d ${D}${systemd_unitdir}/system/
    install -m 0644 ${WORKDIR}/vcan-ec2-receiver.service ${D}${systemd_unitdir}/system/

    install -d ${D}${bindir}
    install -m 0755 ${WORKDIR}/vcan-ec2-receiver.sh ${D}${bindir}/
    
    install -d ${D}${bindir}
    install -m 0755 ${WORKDIR}/vcan-ec2-receiver.env ${D}${bindir}/
}

FILES:${PN} += "\
    ${bindir}/firecracker \
"

FILES:${PN} += " \
    ${systemd_system_unitdir} \
    ${bindir} \
    "

RDEPENDS:${PN} += " \
    bash \
    curl \
    vcan0-netdev-config \
    "

SYSTEMD_AUTO_ENABLE = "enable"
SYSTEMD_SERVICE:${PN} = "vcan-ec2-receiver.service"