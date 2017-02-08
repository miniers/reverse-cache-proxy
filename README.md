build:
bash build.sh

run:
bash run.sh

查看日志：
    node  : bash log.sh
    nginx : bash nginxlog.sh

使用方法：
    地址：http://[目标网站协议]_[目标网站url]_[目标网站端口].cache.local:1314
例如：
    源镜像地址：https://registry.npm.taobao.org 
    缓存镜像地址：http://https_registry.npm.taobao.org_443.cache.local:1314
    或者 : http://cache.local:1314/_/https://registry.npm.taobao.org:443


删除缓存

1.指定文件：
    f_del_file
    http://https_mirrors.ustc.edu.cn_443.cachel.6-k.cc:2080/f_del_file/archlinux/staging/os/x86_64/hefur-0.4-11-x86_64.pkg.tar.xz
    
2.删除目录及内部所有文件和目录:
    f_del_dir
    http://https_mirrors.ustc.edu.cn_443.cachel.6-k.cc:2080/f_del_dir/archlinux/
