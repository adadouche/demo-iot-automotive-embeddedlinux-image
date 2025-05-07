#!/bin/bash
set -e

. ./vcan-ec2-receiver.env

TOKEN=$(curl --silent -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_IP=$(curl --silent -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/local-ipv4)

echo "USE_MULTICAST....................: $USE_MULTICAST"
echo "USE_MULTICAST_GROUP_MEMBERSHIP_IP: $USE_MULTICAST_GROUP_MEMBERSHIP_IP"
echo "INSTANCE_IP......................: $INSTANCE_IP"
echo "SOCAT_PORT.......................: $SOCAT_PORT"

if [ "$USE_MULTICAST" == "true" ]
then
    socat UDP4-RECVFROM:$SOCAT_PORT,ip-add-membership=$USE_MULTICAST_GROUP_MEMBERSHIP_IP:$INSTANCE_IP,fork - | while read line; do cansend vcan0 $line; done
elif [ "$USE_MULTICAST" == "false" ]
then
    socat UDP4-RECVFROM:$SOCAT_PORT,fork - | while read line; do cansend vcan0 $line; done
else
    socat UDP4-RECVFROM:$SOCAT_PORT,fork - | while read line; do cansend vcan0 $line; done
fi