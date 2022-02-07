/**
 * 有关项目本地文件的所有方法
 * @author ybw0014
 */

const fileSystem = require('fs')
const fs = fileSystem.promises
const path = require('path')
const _ = require('lodash')

const config = require('./config')
const logger = require('./logger')

module.exports = {
    /**
     * 获取所有项目
     * @returns {Promise} 包含项目列表的Promise
     */
    getProjects () {
        return new Promise((resolve, reject) => {
            fs.readFile(path.resolve(process.cwd(), './static/repos.json'), 'utf-8')
                .then((repos) => {
                    const tasks = []
                    const json = JSON.parse(repos)

                    for (const repo in json) {
                        logger.log(`> 已加载项目 ${repo}`)

                        let taskInfo = {
                            user: repo.split('/')[0],
                            repo: repo.split('/')[1].split(':')[0],
                            branch: repo.split(':')[1]
                        }

                        taskInfo.directory = taskInfo.user + '/' + taskInfo.repo + '/' + taskInfo.branch

                        if (json[repo].options) {
                            taskInfo.options = json[repo].options
                        }

                        tasks.push(taskInfo)
                    }

                    resolve(tasks)
                }, reject)
        })
    },

    /**
     * 与本地存储对比，查询是否有更新内容
     *
     * @param task 任务
     * @param timestamp 最新时间戳
     * @returns {Promise} 如果有更新内容则resolve, 包含新版本号
     */
    hasUpdate (task, timestamp) {
        return new Promise((resolve, reject) => {
            const filePath = path.resolve(__dirname, '../../', config.projects_dir, task.directory, './builds.json')
            // 检查文件是否存在
            if (!fileSystem.existsSync(filePath)) {
                logger.log('> 全新构建 #1')
                resolve(1)
                return
            }
            fs.readFile(filePath, 'utf8').then((builds) => {
                let json = JSON.parse(builds)
                if (json.latest < timestamp) {
                    let version = _.last(json.builds).id + 1
                    logger.log('> 构建新版本 #' + version)
                    resolve(version)
                } else {
                    logger.log('> 无更新内容')
                    reject(new Error('无更新内容'))
                }
            }).catch(reject)
        })
    },

    /**
     * 获取任务工作目录
     * @param task 任务
     * @returns {string} 工作目录
     */
    getWorkingDirectory (task) {
        return path.resolve(__dirname, '../../', config.projects_dir, task.directory, config.project_workspace_dir)
    },

    /**
     * 新增构建
     * @param task 任务
     * @returns {Promise} resolve
     */
    addBuild (task) {
        return new Promise((resolve, reject) => {
            const filePath = path.resolve(__dirname, '../../', config.projects_dir, task.directory, './builds.json')

            let build = {
                id: task.version,
                success: task.success,
                commit: task.commit.hash,
                build_timestamp: new Date().getTime(),
                timestamp: task.commit.timestamp,
                message: task.commit.message,
                author: task.commit.author,
                version: task.versionStr,
                target: task.finalName + '.jar'
            }

            logger.log('> 保存构建信息')
            // 检查文件是否存在
            if (!fileSystem.existsSync(filePath)) {
                let builds = {
                    latest: task.commit.timestamp,
                    builds: [
                        build
                    ]
                }
                fs.writeFile(filePath, JSON.stringify(builds)).then(resolve, reject)
            } else {
                fs.readFile(filePath, 'utf8').then((builds) => {
                    let json = JSON.parse(builds)
                    json.latest = task.commit.timestamp
                    json.builds.push(build)
                    fs.writeFile(filePath, JSON.stringify(json)).then(resolve, reject)
                }).catch(reject)
            }
        })
    },

    /**
     * 生成任务标识
     * @param task 任务
     * @returns {Promise} resolve
     */
    addBadge (task) {
        return new Promise((resolve, reject) => {
            let badgeTemplate = path.resolve(__dirname, '../../assets/images/badge.svg')
            let badgeTarget = path.resolve(this.getWorkingDirectory(task), '../badge.svg')

            logger.log('> 生成任务标识')
            fs.readFile(badgeTemplate, 'utf-8').then((badge) => {
                /* eslint-disable no-template-curly-in-string */
                if (task.success) {
                    badge = badge.replace('${status}', '成功')
                        .replace('${color}', '#009688')
                } else {
                    badge = badge.replace('${status}', '失败')
                        .replace('${color}', '#f34436')
                }
                /* eslint-enable no-template-curly-in-string */
                fs.writeFile(badgeTarget, badge).then(resolve, reject)
            })
        })
    },

    /**
     * 清理任务工作区
     * @param task
     */
    clearWorkspace (task) {
        let workspace = this.getWorkingDirectory(task)
        if (fileSystem.existsSync(workspace)) {
            fileSystem.rmSync(workspace, { recursive: true })
        }
        return Promise.resolve()
    }
}
