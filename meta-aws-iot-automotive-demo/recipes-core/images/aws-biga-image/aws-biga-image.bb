SUMMARY = "A image to test meta-aws software"
inherit core-image

IMAGE_INSTALL =+ "packagegroup-core-boot ${CORE_IMAGE_EXTRA_INSTALL}"

IMAGE_LINGUAS = "en-us"

GLIBC_GENERATE_LOCALES = "en_US.UTF-8"

LICENSE = "MIT"

IMAGE_ROOTFS_SIZE ?= "8192"

### AWS ###
IMAGE_INSTALL =+ "greengrass-bin"

### test
# IMAGE_INSTALL =+ "gg-obs-ipc gg-obs-pub-can-data gg-obs-pub-rtos-app-data gg-obs-pub-rtos-os-data ipc-shm-us"

# allow obs to run
IMAGE_INSTALL =+ "aws-iot-device-sdk-cpp-v2 python3-pyserial fmt python3-can aws-iot-device-sdk-python-v2"

# non busybox version of nc is required for receiving broadcast udp packages
IMAGE_INSTALL =+ "netcat"

# 500MB
IMAGE_ROOTFS_EXTRA_SPACE = "524288"

INIT_MANAGER = "systemd"

# necessary for ROS
ROS_SYSROOT_BUILD_DEPENDENCIES = " \
    ament-lint-auto \
    ament-cmake-auto \
    ament-cmake-core \
    ament-cmake-cppcheck \
    ament-cmake-cpplint \
    ament-cmake-export-definitions \
    ament-cmake-export-dependencies \
    ament-cmake-export-include-directories \
    ament-cmake-export-interfaces \
    ament-cmake-export-libraries \
    ament-cmake-export-link-flags \
    ament-cmake-export-targets \
    ament-cmake-gmock \
    ament-cmake-gtest \
    ament-cmake-include-directories \
    ament-cmake-libraries \
    ament-cmake \
    ament-cmake-pytest \
    ament-cmake-python \
    ament-cmake-ros \
    ament-cmake-target-dependencies \
    ament-cmake-test \
    ament-cmake-version \
    ament-cmake-uncrustify \
    ament-cmake-flake8 \
    ament-cmake-pep257 \
    ament-copyright \
    ament-cpplint \
    ament-flake8 \
    ament-index-python \
    ament-lint-cmake \
    ament-mypy \
    ament-package \
    ament-pclint \
    ament-pep257 \
    ament-pycodestyle \
    ament-pyflakes \
    ament-uncrustify \
    ament-xmllint \
    cmake \
    eigen3-cmake-module \
    fastcdr \
    fastrtps-cmake-module \
    fastrtps \
    git \
    gmock-vendor \
    gtest-vendor \
    pkgconfig \
    python-cmake-module \
    python3-catkin-pkg \
    python3-empy \
    python3 \
    python3-pytest \
    rcutils \
    rmw-implementation-cmake \
    rosidl-cmake \
    rosidl-default-generators \
    rosidl-generator-c \
    rosidl-generator-cpp \
    rosidl-generator-dds-idl \
    rosidl-generator-py \
    rosidl-parser \
    rosidl-runtime-c \
    rosidl-runtime-cpp \
    rosidl-typesupport-c \
    rosidl-typesupport-cpp \
    rosidl-typesupport-fastrtps-cpp \
    rosidl-typesupport-interface \
    rosidl-typesupport-introspection-c \
    rosidl-typesupport-introspection-cpp \
    foonathan-memory-vendor \
    libyaml-vendor \
"

IMAGE_INSTALL:append = " \
    ros-base \
    examples-rclcpp-minimal-action-client \
    examples-rclcpp-minimal-action-server \
    examples-rclcpp-minimal-client \
    examples-rclcpp-minimal-composition \
    examples-rclcpp-minimal-publisher \
    examples-rclcpp-minimal-service \
    examples-rclcpp-minimal-subscriber \
    examples-rclcpp-minimal-timer \
    examples-rclcpp-multithreaded-executor \
    demo-nodes-cpp \
    demo-nodes-cpp-rosnative \
    cyclonedds \
    rmw-cyclonedds-cpp \
    tmux \
    python3-argcomplete \
    glibc-utils \
    localedef \
    rt-tests \
    stress \
    opencl-headers-dev \
    opencl-clhpp-dev \
    ${ROS_SYSROOT_BUILD_DEPENDENCIES} \
"
# define the ROS 2 Yocto target release
ROS_OE_RELEASE_SERIES = "kirkstone"

# define ROS 2 distro
ROS_DISTRO = "galactic"

# EXTRA_IMAGE_FEATURES ?= "ros-implicit-workspace"

IMAGE_INSTALL  += "iproute2 canutils"

IMAGE_INSTALL += "openssh-sshd"

IMAGE_INSTALL  += "aws-iot-device-sdk-cpp-v2 python3-pyserial fmt python3-can aws-iot-device-sdk-python-v2"

IMAGE_ROOTFS_EXTRA_SPACE = "1048576"

EXTRA_IMAGE_FEATURES += "debug-tweaks tools-debug"

# other configuration is part of site.conf (see readme)
GGV2_THING_NAME  = "vCar"
GGV2_TES_RALIAS  = "GGTokenExchangeRoleAlias"


IMAGE_INSTALL += "kmod"

IMAGE_INSTALL += "socat"

IMAGE_INSTALL += "netcat"

IMAGE_INSTALL += "curl"

# this needs to be done in local.conf
# KERNEL_MODULE_AUTOLOAD += "vcan"

# create vcan0 network interface
IMAGE_INSTALL += "vcan0-netdev-config"
